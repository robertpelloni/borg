package rag

import (
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"sync"
)

type Vector []float32

type Document struct {
	ID        string            `json:"id"`
	Content   string            `json:"content"`
	Embedding Vector            `json:"embedding,omitempty"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	Score     float32           `json:"-"`
}

type VectorStore interface {
	Add(docs ...*Document) error
	Search(query Vector, k int) ([]*Document, error)
	Delete(ids ...string) error
	Count() int
	Save(path string) error
	Load(path string) error
}

type HNSWConfig struct {
	M              int
	EfConstruction int
	EfSearch       int
	ML             float64
	Dimensions     int
}

func DefaultHNSWConfig(dimensions int) *HNSWConfig {
	return &HNSWConfig{
		M:              16,
		EfConstruction: 200,
		EfSearch:       50,
		ML:             1.0 / math.Log(float64(16)),
		Dimensions:     dimensions,
	}
}

type hnswNode struct {
	ID               string
	Vector           Vector
	Level            int
	NeighborsByLevel [][]string
	Document         *Document
}

type HNSWIndex struct {
	mu         sync.RWMutex
	config     *HNSWConfig
	nodes      map[string]*hnswNode
	entryPoint string
	maxLevel   int
}

func NewHNSWIndex(config *HNSWConfig) *HNSWIndex {
	if config == nil {
		config = DefaultHNSWConfig(1536)
	}
	return &HNSWIndex{
		config:   config,
		nodes:    make(map[string]*hnswNode),
		maxLevel: -1,
	}
}

func (h *HNSWIndex) Add(docs ...*Document) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, doc := range docs {
		if doc.ID == "" {
			return fmt.Errorf("document ID cannot be empty")
		}
		if len(doc.Embedding) == 0 {
			return fmt.Errorf("document %s has no embedding", doc.ID)
		}
		if len(doc.Embedding) != h.config.Dimensions {
			return fmt.Errorf("document %s has wrong dimensions: got %d, want %d",
				doc.ID, len(doc.Embedding), h.config.Dimensions)
		}

		level := h.randomLevel()
		node := &hnswNode{
			ID:               doc.ID,
			Vector:           doc.Embedding,
			Level:            level,
			NeighborsByLevel: make([][]string, level+1),
			Document:         doc,
		}
		for i := range node.NeighborsByLevel {
			node.NeighborsByLevel[i] = make([]string, 0, h.config.M)
		}

		if h.entryPoint == "" {
			h.nodes[doc.ID] = node
			h.entryPoint = doc.ID
			h.maxLevel = level
			continue
		}

		current := h.entryPoint
		for l := h.maxLevel; l > level; l-- {
			current = h.greedySearch(current, doc.Embedding, l)
		}

		for l := min(level, h.maxLevel); l >= 0; l-- {
			neighbors := h.searchLayer(current, doc.Embedding, h.config.EfConstruction, l)
			selected := h.selectNeighborsByLevel(doc.Embedding, neighbors, h.config.M)
			node.NeighborsByLevel[l] = selected

			for _, neighborID := range selected {
				neighbor := h.nodes[neighborID]
				if neighbor != nil && l < len(neighbor.NeighborsByLevel) {
					neighbor.NeighborsByLevel[l] = h.addNeighbor(neighbor.NeighborsByLevel[l], doc.ID, neighbor.Vector)
				}
			}

			if len(neighbors) > 0 {
				current = neighbors[0]
			}
		}

		h.nodes[doc.ID] = node

		if level > h.maxLevel {
			h.maxLevel = level
			h.entryPoint = doc.ID
		}
	}

	return nil
}

func (h *HNSWIndex) Search(query Vector, k int) ([]*Document, error) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.entryPoint == "" {
		return nil, nil
	}

	if len(query) != h.config.Dimensions {
		return nil, fmt.Errorf("query has wrong dimensions: got %d, want %d",
			len(query), h.config.Dimensions)
	}

	current := h.entryPoint
	for l := h.maxLevel; l > 0; l-- {
		current = h.greedySearch(current, query, l)
	}

	candidates := h.searchLayer(current, query, h.config.EfSearch, 0)

	results := make([]*Document, 0, min(k, len(candidates)))
	for i := 0; i < min(k, len(candidates)); i++ {
		node := h.nodes[candidates[i]]
		if node != nil && node.Document != nil {
			doc := *node.Document
			doc.Score = cosineSimilarity(query, node.Vector)
			results = append(results, &doc)
		}
	}

	return results, nil
}

func (h *HNSWIndex) Delete(ids ...string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, id := range ids {
		node, exists := h.nodes[id]
		if !exists {
			continue
		}

		for l := 0; l <= node.Level; l++ {
			for _, neighborID := range node.NeighborsByLevel[l] {
				neighbor := h.nodes[neighborID]
				if neighbor != nil && l < len(neighbor.NeighborsByLevel) {
					neighbor.NeighborsByLevel[l] = removeFromSlice(neighbor.NeighborsByLevel[l], id)
				}
			}
		}

		delete(h.nodes, id)

		if h.entryPoint == id {
			h.entryPoint = ""
			h.maxLevel = -1
			for nodeID, n := range h.nodes {
				if n.Level > h.maxLevel {
					h.maxLevel = n.Level
					h.entryPoint = nodeID
				}
			}
		}
	}

	return nil
}

func (h *HNSWIndex) Count() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.nodes)
}

type hnswSaveFormat struct {
	Config     *HNSWConfig          `json:"config"`
	Nodes      map[string]*hnswNode `json:"nodes"`
	EntryPoint string               `json:"entry_point"`
	MaxLevel   int                  `json:"max_level"`
}

func (h *HNSWIndex) Save(path string) error {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create directory: %w", err)
	}

	data := &hnswSaveFormat{
		Config:     h.config,
		Nodes:      h.nodes,
		EntryPoint: h.entryPoint,
		MaxLevel:   h.maxLevel,
	}

	file, err := os.Create(path)
	if err != nil {
		return fmt.Errorf("create file: %w", err)
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	if err := encoder.Encode(data); err != nil {
		return fmt.Errorf("encode: %w", err)
	}

	return nil
}

func (h *HNSWIndex) Load(path string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open file: %w", err)
	}
	defer file.Close()

	var data hnswSaveFormat
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&data); err != nil {
		return fmt.Errorf("decode: %w", err)
	}

	h.config = data.Config
	h.nodes = data.Nodes
	h.entryPoint = data.EntryPoint
	h.maxLevel = data.MaxLevel

	return nil
}

func (h *HNSWIndex) randomLevel() int {
	level := 0
	for level < 32 && fastRand() < uint32(math.Exp(-float64(level)*h.config.ML)*float64(math.MaxUint32)) {
		level++
	}
	return level
}

func (h *HNSWIndex) greedySearch(start string, query Vector, level int) string {
	current := start
	currentDist := h.distance(query, h.nodes[current].Vector)

	for {
		node := h.nodes[current]
		if node == nil || level >= len(node.NeighborsByLevel) {
			break
		}

		improved := false
		for _, neighborID := range node.NeighborsByLevel[level] {
			neighbor := h.nodes[neighborID]
			if neighbor == nil {
				continue
			}
			dist := h.distance(query, neighbor.Vector)
			if dist < currentDist {
				current = neighborID
				currentDist = dist
				improved = true
			}
		}

		if !improved {
			break
		}
	}

	return current
}

func (h *HNSWIndex) searchLayer(start string, query Vector, ef int, level int) []string {
	visited := make(map[string]bool)
	candidates := &distanceHeap{query: query, nodes: h.nodes, maxHeap: false}
	results := &distanceHeap{query: query, nodes: h.nodes, maxHeap: true}

	visited[start] = true
	candidates.Push(start)
	results.Push(start)

	for candidates.Len() > 0 {
		current := candidates.Pop()
		node := h.nodes[current]
		if node == nil || level >= len(node.NeighborsByLevel) {
			continue
		}

		furthest := results.Peek()
		if h.distance(query, h.nodes[current].Vector) > h.distance(query, h.nodes[furthest].Vector) {
			break
		}

		for _, neighborID := range node.NeighborsByLevel[level] {
			if visited[neighborID] {
				continue
			}
			visited[neighborID] = true

			neighbor := h.nodes[neighborID]
			if neighbor == nil {
				continue
			}

			furthest = results.Peek()
			if results.Len() < ef || h.distance(query, neighbor.Vector) < h.distance(query, h.nodes[furthest].Vector) {
				candidates.Push(neighborID)
				results.Push(neighborID)
				if results.Len() > ef {
					results.Pop()
				}
			}
		}
	}

	return results.Items()
}

func (h *HNSWIndex) selectNeighborsByLevel(query Vector, candidates []string, m int) []string {
	if len(candidates) <= m {
		return candidates
	}

	type scored struct {
		id   string
		dist float32
	}
	scored_candidates := make([]scored, len(candidates))
	for i, id := range candidates {
		scored_candidates[i] = scored{id: id, dist: h.distance(query, h.nodes[id].Vector)}
	}
	sort.Slice(scored_candidates, func(i, j int) bool {
		return scored_candidates[i].dist < scored_candidates[j].dist
	})

	result := make([]string, m)
	for i := 0; i < m; i++ {
		result[i] = scored_candidates[i].id
	}
	return result
}

func (h *HNSWIndex) addNeighbor(neighbors []string, newID string, nodeVector Vector) []string {
	neighbors = append(neighbors, newID)
	if len(neighbors) <= h.config.M {
		return neighbors
	}
	return h.selectNeighborsByLevel(nodeVector, neighbors, h.config.M)
}

func (h *HNSWIndex) distance(a, b Vector) float32 {
	return 1.0 - cosineSimilarity(a, b)
}

func cosineSimilarity(a, b Vector) float32 {
	if len(a) != len(b) {
		return 0
	}

	var dotProduct, normA, normB float32
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0
	}

	return dotProduct / (float32(math.Sqrt(float64(normA))) * float32(math.Sqrt(float64(normB))))
}

type distanceHeap struct {
	items   []string
	query   Vector
	nodes   map[string]*hnswNode
	maxHeap bool
}

func (h *distanceHeap) Len() int { return len(h.items) }

func (h *distanceHeap) Less(i, j int) bool {
	distI := float32(1.0) - cosineSimilarity(h.query, h.nodes[h.items[i]].Vector)
	distJ := float32(1.0) - cosineSimilarity(h.query, h.nodes[h.items[j]].Vector)
	if h.maxHeap {
		return distI > distJ
	}
	return distI < distJ
}

func (h *distanceHeap) Swap(i, j int) { h.items[i], h.items[j] = h.items[j], h.items[i] }

func (h *distanceHeap) Push(x string) {
	h.items = append(h.items, x)
	h.up(len(h.items) - 1)
}

func (h *distanceHeap) Pop() string {
	if len(h.items) == 0 {
		return ""
	}
	root := h.items[0]
	h.items[0] = h.items[len(h.items)-1]
	h.items = h.items[:len(h.items)-1]
	if len(h.items) > 0 {
		h.down(0)
	}
	return root
}

func (h *distanceHeap) Peek() string {
	if len(h.items) == 0 {
		return ""
	}
	return h.items[0]
}

func (h *distanceHeap) Items() []string {
	result := make([]string, len(h.items))
	copy(result, h.items)
	sort.Slice(result, func(i, j int) bool {
		distI := float32(1.0) - cosineSimilarity(h.query, h.nodes[result[i]].Vector)
		distJ := float32(1.0) - cosineSimilarity(h.query, h.nodes[result[j]].Vector)
		return distI < distJ
	})
	return result
}

func (h *distanceHeap) up(i int) {
	for i > 0 {
		parent := (i - 1) / 2
		if !h.Less(i, parent) {
			break
		}
		h.Swap(i, parent)
		i = parent
	}
}

func (h *distanceHeap) down(i int) {
	for {
		smallest := i
		left := 2*i + 1
		right := 2*i + 2

		if left < len(h.items) && h.Less(left, smallest) {
			smallest = left
		}
		if right < len(h.items) && h.Less(right, smallest) {
			smallest = right
		}

		if smallest == i {
			break
		}

		h.Swap(i, smallest)
		i = smallest
	}
}

func removeFromSlice(slice []string, item string) []string {
	for i, v := range slice {
		if v == item {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

var randState uint32 = 1

func fastRand() uint32 {
	randState ^= randState << 13
	randState ^= randState >> 17
	randState ^= randState << 5
	return randState
}

func VectorToBytes(v Vector) []byte {
	buf := make([]byte, len(v)*4)
	for i, f := range v {
		binary.LittleEndian.PutUint32(buf[i*4:], math.Float32bits(f))
	}
	return buf
}

func BytesToVector(b []byte) Vector {
	v := make(Vector, len(b)/4)
	for i := range v {
		v[i] = math.Float32frombits(binary.LittleEndian.Uint32(b[i*4:]))
	}
	return v
}
